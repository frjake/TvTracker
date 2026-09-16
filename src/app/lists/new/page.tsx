import { requireUser } from "@/lib/auth";
import { NewListForm } from "./NewListForm";

export const metadata = { title: "New list" };

export default async function NewListPage() {
  await requireUser("/lists/new");
  return <NewListForm />;
}
