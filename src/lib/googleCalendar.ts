export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
  status?: string;
  htmlLink?: string;
  updated?: string;
}

const CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export const listGoogleCalendarEvents = async (
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> => {
  let allItems: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL(CALENDAR_BASE_URL);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '250');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }
    if (timeMin) url.searchParams.set('timeMin', timeMin);
    if (timeMax) url.searchParams.set('timeMax', timeMax);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar Fetch Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (Array.isArray(data.items)) {
      allItems = allItems.concat(data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
};

export const createGoogleCalendarEvent = async (
  accessToken: string,
  event: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> => {
  const response = await fetch(CALENDAR_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar Event Create Error (${response.status}): ${errText}`);
  }

  return await response.json();
};

export const updateGoogleCalendarEvent = async (
  accessToken: string,
  eventId: string,
  event: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> => {
  const response = await fetch(`${CALENDAR_BASE_URL}/${eventId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar Event Update Error (${response.status}): ${errText}`);
  }

  return await response.json();
};

export const deleteGoogleCalendarEvent = async (
  accessToken: string,
  eventId: string
): Promise<void> => {
  const response = await fetch(`${CALENDAR_BASE_URL}/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errText = await response.text();
    throw new Error(`Google Calendar Event Delete Error (${response.status}): ${errText}`);
  }
};
