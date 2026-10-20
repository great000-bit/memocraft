import Link from "next/link";
import { JsonLd } from "../JsonLd";
import { MarketingFooter } from "../MarketingFooter";
import { SiteNav } from "../SiteNav";
import { SITE_URL } from "@/lib/site";
import styles from "./Marketing.module.css";

type Crumb = { name: string; path: string };

// The frame of a public marketing page: the navigation, breadcrumbs (also published as structured data) and footer.
export function MarketingPage({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  const trail = [{ name: "Memocraft", path: "/" }, ...crumbs];
  return (
    <div className={`neu-scope ${styles.page}`}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: `${SITE_URL}${c.path === "/" ? "" : c.path}`,
          })),
        }}
      />
      <SiteNav />
      <main>
        <nav className={`${styles.wrap} ${styles.crumbs}`} aria-label="Breadcrumb">
          <ol>
            {trail.map((c, i) => (
              <li key={c.path}>
                {i === trail.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path}>{c.name}</Link>}
              </li>
            ))}
          </ol>
        </nav>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
