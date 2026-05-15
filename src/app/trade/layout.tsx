export default function TradeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-clip px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[min(90rem,calc(100vw-2rem))]">
        {children}
      </div>
    </div>
  );
}
