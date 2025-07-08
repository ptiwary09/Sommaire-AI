"use server";

import { getDbConnection } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function deleteSummaryAction({
  summaryId,
  userId,
}: {
  summaryId: string;
  userId: string;
}) {
  try {
    console.log('Attempting to delete summary:', { summaryId, userId });

    if (!userId) {
      console.error('User ID is required');
      return { success: false, error: 'User not authenticated' };
    }

    if (!summaryId) {
      console.error('Summary ID is required');
      return { success: false, error: 'Summary ID is required' };
    }

    const sql = await getDbConnection();

    // First, check if the summary exists and belongs to the user
    const checkResult = await sql`
      SELECT id FROM pdf_summaries 
      WHERE id = ${summaryId} AND user_id = ${userId}
    `;

    if (checkResult.length === 0) {
      console.error('Summary not found or user not authorized');
      return { success: false, error: 'Summary not found or unauthorized' };
    }

    // Now delete the summary
    const result = await sql`
      DELETE FROM pdf_summaries 
      WHERE id = ${summaryId} AND user_id = ${userId}
      RETURNING id
    `;

    console.log('Delete result:', result);

    if (result.length > 0) {
      console.log('Summary deleted successfully');
      revalidatePath('/dashboard');
      return { success: true };
    } else {
      console.error('Delete operation failed - no rows affected');
      return { success: false, error: 'Failed to delete summary' };
    }
  } catch (error) {
    console.error('Error deleting summary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}