import { useParams } from "react-router-dom";

export default function AdminRequestDetail() {
    const { id } = useParams();

    return (
        <div className="font-jakarta">
            <h1 className="text-lg font-semibold text-zinc-800 mb-2">Detail Permintaan</h1>
            <p className="text-xs text-zinc-500">Permintaan #{id}</p>
        </div>
    );
}
