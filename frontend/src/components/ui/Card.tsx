import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    footer?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', title, children, footer, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`
          bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 
          shadow-sm overflow-hidden
          ${className}
        `}
                {...props}
            >
                {title && (
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {title}
                        </h3>
                    </div>
                )}
                <div className="p-4">
                    {children}
                </div>
                {footer && (
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                        {footer}
                    </div>
                )}
            </div>
        );
    }
);

Card.displayName = 'Card';
