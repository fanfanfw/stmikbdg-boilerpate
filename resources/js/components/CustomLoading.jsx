import { Skeleton } from "@mui/material"

export default function CustomLoading({
    loading = false,
    children,
    width = '100%',
    variant = 'rounded',
    renderIf = true,
    sketch
}) {
    return !loading && renderIf ? (
        <>
            {children}
        </>
    ) : (
        <Skeleton variant={variant} width={width}>
            {sketch || children}
        </Skeleton>
    )
}
