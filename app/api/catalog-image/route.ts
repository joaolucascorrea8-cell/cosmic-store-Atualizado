import { catalogImageResponse } from "@/lib/catalog-image-response";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return catalogImageResponse(request, process.env.NEXT_PUBLIC_SUPABASE_URL);
}
