export interface AppDataPayload {
  plannerItems?: any[];
  routines?: any[];
  checklist?: any[];
  diaries?: any[];
  financials?: any[];
  userStickers?: any[];
  categories?: any[];
  lastSyncedAt?: string;
  exportedAt?: string;
  [key: string]: any;
}

export function formatBackupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const mins = pad(date.getMinutes());
  const secs = pad(date.getSeconds());
  return `chronicle_planner_backup_${year}-${month}-${day}_${hours}-${mins}-${secs}.json`;
}

/**
 * Searches for all chronicle_planner_backup files in the user's Google Drive root folder,
 * returning the most recently modified file ID.
 */
export async function findLatestDriveBackupFileId(accessToken: string): Promise<{ id: string; name: string; modifiedTime?: string } | null> {
  const query = encodeURIComponent(`name contains 'chronicle_planner_backup' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Google Drive search failed:', errText);
    throw new Error(`Google Drive search failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    // Top file is the most recent according to modifiedTime desc
    return data.files[0];
  }
  return null;
}

/**
 * Downloads data from the user's most recent Google Drive backup file.
 */
export async function fetchAppDataFromGoogleDrive(accessToken: string): Promise<{ data: AppDataPayload | null; lastSyncedAt?: string; fileId?: string; fileName?: string }> {
  try {
    const fileInfo = await findLatestDriveBackupFileId(accessToken);
    if (!fileInfo) {
      return { data: null };
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}?alt=media`;
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download Google Drive file (${response.status})`);
    }

    const jsonContent = await response.json();
    const syncTime = jsonContent.lastSyncedAt || jsonContent.exportedAt || fileInfo.modifiedTime || new Date().toISOString();
    return {
      data: jsonContent,
      lastSyncedAt: syncTime,
      fileId: fileInfo.id,
      fileName: fileInfo.name,
    };
  } catch (err) {
    console.error('fetchAppDataFromGoogleDrive error:', err);
    throw err;
  }
}

/**
 * Saves or updates app data directly to the user's Google Drive account with timestamped filename.
 */
export async function saveAppDataToGoogleDrive(accessToken: string, payload: AppDataPayload): Promise<{ success: boolean; fileId: string; lastSyncedAt: string; fileName: string }> {
  try {
    const now = new Date();
    const timestampIso = now.toISOString();
    const timestampedFileName = formatBackupFileName(now);

    const contentToSave = {
      ...payload,
      exportedAt: timestampIso,
      lastSyncedAt: timestampIso,
      backupTimestamp: now.getTime(),
      appName: 'Plock Planner & Diary',
    };

    const jsonString = JSON.stringify(contentToSave, null, 2);

    // Create a new timestamped backup file on Google Drive using multipart upload
    const metadata = {
      name: timestampedFileName,
      mimeType: 'application/json',
      description: `Plock Planner & Diary Backup Data (${timestampIso})`,
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonString +
      closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Drive create failed (${response.status}): ${err}`);
    }

    const createdFile = await response.json();
    return {
      success: true,
      fileId: createdFile.id,
      fileName: timestampedFileName,
      lastSyncedAt: timestampIso,
    };
  } catch (err) {
    console.error('saveAppDataToGoogleDrive error:', err);
    throw err;
  }
}
