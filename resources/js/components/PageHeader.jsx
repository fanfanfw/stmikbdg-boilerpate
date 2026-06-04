import CustomBreadcrumb from './CustomBreadcrumb';

export default function PageHeader({ title, subtitle, breadcrumbs, actions }) {
    return (
        <div className="mb-4">
            {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="mb-2">
                    <CustomBreadcrumb items={breadcrumbs} />
                </div>
            )}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-800">{title}</h1>
                    {subtitle && (
                        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
