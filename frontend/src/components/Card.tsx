import React from 'react';

export const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={`bg-white dark:bg-slate-950 rounded-[32px] shadow-[0_30px_100px_-40px_rgba(15,23,42,0.18)] border border-slate-200/70 dark:border-slate-800/70 overflow-hidden transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, action }: { title: string, subtitle?: string, action?: React.ReactNode }) => {
  return (
    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 transition-colors">
      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="ml-4">{action}</div>}
    </div>
  );
};

export const CardBody = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 transition-colors">
      {children}
    </div>
  );
};
