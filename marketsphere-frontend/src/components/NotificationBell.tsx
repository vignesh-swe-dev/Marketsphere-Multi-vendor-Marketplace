import React, { useState, useRef, useEffect } from 'react';
import { Bell, Package, Truck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Order } from '../types/index.ts';
import { IconButton, Badge } from './ui/index.ts';
import { formatDate } from '../lib/formatters.ts';

export interface NotificationBellProps {
  orders?: Order[];
  onSelectOrder?: (orderId: string) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  orderId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ orders = [], onSelectOrder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notifications come only from the customer's real, recent orders
  const notifications: NotificationItem[] = [
    ...orders.slice(0, 3).map((order) => ({
      id: `order-${order.id}`,
      title: `Order ${order.orderNumber} ${order.status.toLowerCase()}`,
      description: `${order.sellerOrders.length} suborders processed via escrow ledger`,
      timestamp: order.createdAt,
      icon: <Package className="w-4 h-4 text-indigo-500" />,
      orderId: order.id,
    })),
  ];

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  const markAllRead = () => {
    setReadIds(notifications.map((n) => n.id));
  };

  return (
    <div className="relative" ref={containerRef}>
      <IconButton
        variant="default"
        size="sm"
        aria-label={`Notifications (${unreadCount} unread)`}
        title="View notifications"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 pointer-events-none">
            {unreadCount}
          </span>
        )}
      </IconButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="primary" size="sm">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
              {notifications.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No notifications yet. Order updates will appear here.
                </p>
              )}
              {notifications.map((n) => {
                const isRead = readIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!isRead) setReadIds((prev) => [...prev, n.id]);
                      if (n.orderId) onSelectOrder?.(n.orderId);
                    }}
                    className={`p-3 rounded-2xl border transition-colors cursor-pointer text-xs space-y-1 ${
                      isRead
                        ? 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75'
                        : 'border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {n.icon}
                      <span className="font-bold text-slate-900 dark:text-white flex-1 truncate">
                        {n.title}
                      </span>
                      {!isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {n.description}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatDate(n.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
