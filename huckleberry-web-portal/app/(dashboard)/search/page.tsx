import { SearchResultsClient } from "./SearchResultsClient";

// Force dynamic rendering to prevent static pre-render errors
export const dynamic = 'force-dynamic';

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SearchResultsPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "") || "";
  const dateFrom = (typeof params.dateFrom === "string" ? params.dateFrom : "") || "";
  const dateTo = (typeof params.dateTo === "string" ? params.dateTo : "") || "";
  const tagsParam = typeof params.tags === "string" ? params.tags : "";
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

  return (
    <SearchResultsClient
      initialQuery={query}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      initialTags={tags}
    />
  );
}

