import React from 'react';
import { Bell, Clock, X, CalendarCheck2, ArrowRight } from 'lucide-react';
import { UpcomingNotificationAlert } from '../types';

interface NotificationBannerProps {
  alerts: UpcomingNotificationAlert[];
  onDismiss: (id: string) => void;
  onNavigateToPlanner?: () => void;
  primaryColor?: string;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  alerts,
  onDismiss,
  onNavigateToPlanner,
  primaryColor = '#C1876B',
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-full space-y-2 pointer-events-auto animate-bounce-short">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-stone-200/90 relative overflow-hidden group transition-all"
        >
          {/* Top accent bar using theme primary color */}
          <div
            style={{ backgroundColor: primaryColor }}
            className="absolute top-0 left-0 right-0 h-1.5"
          />

          <div className="flex items-start justify-between gap-2 pt-1">
            <div className="flex items-start space-x-3">
              <div
                style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-none shadow-2xs mt-0.5"
              >
                <Bell className="w-5 h-5 animate-pulse" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-current/20"
                  >
                    {alert.dueMinutesLeft <= 0 ? '지금 시작' : `시작 ${alert.dueMinutesLeft}분 전`}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">{alert.time}</span>
                </div>

                <h4 className="font-bold text-stone-900 text-sm leading-snug line-clamp-1">
                  {alert.title}
                </h4>

                <p className="text-xs text-stone-600 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-400" />
                  <span>
                    {alert.dueMinutesLeft <= 0
                      ? '일정 시작 시각이 되었습니다!'
                      : `${alert.dueMinutesLeft}분 후 일정이 시작됩니다. 준비해 보세요.`}
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {onNavigateToPlanner && (
            <div className="mt-3 pt-2 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => {
                  onDismiss(alert.id);
                  onNavigateToPlanner();
                }}
                className="text-[11px] font-bold text-stone-700 hover:text-stone-900 flex items-center space-x-1"
              >
                <span>플래너에서 확인하기</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
