// Customer app: mobile-first column, designed at 390 px.
export default function CustomerLayout({ children }: LayoutProps<'/'>) {
  return <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col">{children}</div>;
}
