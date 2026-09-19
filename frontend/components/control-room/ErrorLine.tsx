export function ErrorLine({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-auto max-w-[1560px] px-[clamp(16px,2.5vw,40px)] pt-4">
      <p className="m-0 rounded-[12px] border border-clay/40 bg-clay/[0.08] px-4 py-3 text-[15px] text-ink">{message}</p>
    </div>
  );
}
