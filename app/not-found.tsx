import Link from "next/link";
import PhotoIcon from "@heroicons/react/24/outline/PhotoIcon";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto py-24 px-6 text-center flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground shadow-inner">
        <PhotoIcon className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Halaman Tidak Ditemukan
      </h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Halaman yang kamu tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link
        href="/"
        className="mt-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95"
      >
        Kembali ke Koleksi Foto
      </Link>
    </div>
  );
}
