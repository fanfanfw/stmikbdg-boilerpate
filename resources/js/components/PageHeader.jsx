import CustomBreadcrumb from './CustomBreadcrumb';

export default function PageHeader({ title, subtitle, breadcrumbs, actions }) {
    return (
        <div className="mb-5">
            {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="mb-3">
                    <CustomBreadcrumb items={breadcrumbs} />
                </div>
            )}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-semibold tracking-wide text-zinc-800">{title}</h1>
                    {subtitle && (
                        <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-3xl leading-relaxed">{subtitle}</p>
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
