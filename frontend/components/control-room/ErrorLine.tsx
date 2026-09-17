export function ErrorLine({ message }: { message: string }) {
  return (
    <div role="alert" className="border-b border-grey-200 px-[clamp(16px,2.4vw,32px)] py-2">
      <p className="border-l-2 border-clay pl-3 text-sm text-grey-700">{message}</p>
    </div>
  );
}
