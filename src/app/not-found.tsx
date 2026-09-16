import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">That page, show, episode or profile doesn&apos;t exist — or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-primary mt-4">Back home</Link>
    </div>
  );
}
