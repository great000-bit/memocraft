// Marketing and sign-in pages always render light, on white, whatever the device theme.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <div className="light-scope">{children}</div>;
}
