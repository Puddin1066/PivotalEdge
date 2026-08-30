import { z } from "zod";

export const ExtractionReviewItemSchema = z.object({
  id: z.string(),
  extractionKind: z.enum(["trial", "regulatory"]),
  entityId: z.string(),
  documentId: z.string(),
  reason: z.string(),
  issues: z.array(z.string()),
  createdAt: z.string(),
  status: z.enum(["pending", "resolved", "rejected"]),
});
export type ExtractionReviewItem = z.infer<typeof ExtractionReviewItemSchema>;

export class ExtractionReviewQueue {
  private items = new Map<string, ExtractionReviewItem>();

  enqueue(item: Omit<ExtractionReviewItem, "id" | "createdAt" | "status">): ExtractionReviewItem {
    const id = `ext_${item.extractionKind}_${item.entityId}_${Date.now()}`;
    const full: ExtractionReviewItem = {
      ...item,
      id,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    this.items.set(id, full);
    return full;
  }

  list(status?: ExtractionReviewItem["status"]): ExtractionReviewItem[] {
    const all = [...this.items.values()];
    return status ? all.filter((i) => i.status === status) : all;
  }

  resolve(id: string): void {
    const item = this.items.get(id);
    if (item) this.items.set(id, { ...item, status: "resolved" });
  }
}
