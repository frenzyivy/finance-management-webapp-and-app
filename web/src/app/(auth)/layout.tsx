export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-[430px] px-6">{children}</div>
    </div>
  );
}
