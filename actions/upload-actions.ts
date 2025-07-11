'use server';
import { getDbConnection } from "@/lib/db";
import { generateSummaryFromGemini } from "@/lib/geminiai";
import { fetchAndExtractPdfText } from "@/lib/langchain";
import { generateSummaryFromOpenAI } from "@/lib/openai";
import { auth } from '@clerk/nextjs/server';
import { formatFileNameAsTitle } from "@/utils/format-utils";
import { revalidatePath } from "next/cache";

interface PdfSummaryType {
    userId?: string;
    fileUrl: string;
    summary: string;
    title: string;
    fileName: string;
    wordCount?: number;
    originalText?: string;
}

// Helper function to count words accurately
function countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    return text.trim().split(/\s+/).filter((word: string) => word.length > 0).length;
}

export async function generatePdfText({
    fileUrl,
}: {
    fileUrl: string;
    fileName: string;
}) {
    if (!fileUrl) {
        return {
            success: false,
            message: 'File upload failed',
            data: null,
        };
    }
    try {
        const pdfText = await fetchAndExtractPdfText(fileUrl);
        console.log({ pdfText });

        if (!pdfText) {
            return {
                success: false,
                message: 'Failed to fetch and extract PDF text',
                data: null,
            };
        }

        return {
            success: true,
            message: 'PDF text fetched successfully',
            data: {
                pdfText,
            },
        };
    } catch (err) {
        return {
            success: false,
            message: 'File upload failed',
            data: null,
        }
    }
}

export async function generatePdfSummary(
    uploadResponse: [
        {
            serverData: {
                userId: string;
                file: {
                    url: string;
                    name: string;
                };
            };
        }
    ]
) {
    if (!uploadResponse) {
        return {
            success: false,
            message: 'File upload Failed',
            data: null,
        };
    }
    const {
        serverData: {
            userId,
            file: { url: pdfUrl, name: fileName },
        },
    } = uploadResponse[0];

    if (!pdfUrl) {
        return {
            success: false,
            message: 'File upload failed',
            data: null,
        };
    }

    try {
        console.log('Starting PDF text extraction...');
        const pdfText = await fetchAndExtractPdfText(pdfUrl);
        console.log('PDF text extracted, length:', pdfText?.length);

        if (!pdfText) {
            return {
                success: false,
                message: 'Failed to extract PDF text',
                data: null,
            };
        }

        // Count words in original PDF text
        const originalWordCount = countWords(pdfText);
        console.log('Original PDF word count:', originalWordCount);

        // Check if file is too large (optional - adjust limit as needed)
        if (originalWordCount > 50000) {
            return {
                success: false,
                message: 'PDF is too large. Please upload a smaller file.',
                data: null,
            };
        }

        let summary;
        try {
            console.log('Generating summary with OpenAI...');
            summary = await generateSummaryFromOpenAI(pdfText);
            console.log('OpenAI summary generated');
        } catch (error) {
            console.log('OpenAI failed:', error);

            // Fallback to Gemini
            if (error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED') {
                try {
                    console.log('Trying Gemini as fallback...');
                    summary = await generateSummaryFromGemini(pdfText);
                    console.log('Gemini summary generated');
                } catch (geminiError) {
                    console.error('Gemini API failed after OpenAI quote exceeded', geminiError);
                    throw new Error('Failed to generate summary with available AI providers');
                }
            } else {
                throw error;
            }
        }

        if (!summary) {
            return {
                success: false,
                message: 'Failed to generate summary',
                data: null,
            };
        }

        const formattedFileName = formatFileNameAsTitle(fileName);
        return {
            success: true,
            message: 'Summary generated successfully',
            data: {
                title: formattedFileName,
                summary,
                originalWordCount,
                originalText: pdfText,
            },
        };
    } catch (err) {
        console.error('Error in generatePdfSummary:', err);
        return {
            success: false,
            message: err instanceof Error ? err.message : 'File processing failed',
            data: null,
        }
    }
}

async function savedPdfSummary({
    userId,
    fileUrl,
    summary,
    title,
    fileName,
    wordCount,
    originalText
}: PdfSummaryType) {
    try {
        const sql = await getDbConnection();
        const [savedSummary] = await sql`
            INSERT INTO pdf_summaries (
                user_id,
                original_file_url,
                summary_text,
                title,
                file_name,
                word_count,
                original_text,
                created_at
            ) VALUES (
                ${userId},
                ${fileUrl},
                ${summary},
                ${title},
                ${fileName},
                ${wordCount || 0},
                ${originalText || ''},
                NOW()
            ) RETURNING id, summary_text, word_count, created_at`;
        return savedSummary;
    } catch (error) {
        console.error('Error saving PDF summary', error);
        throw error;
    }
}

export async function storePdfSummaryAction({
    fileUrl,
    summary,
    title,
    fileName,
    wordCount,
    originalText,
}: PdfSummaryType) {
    let savedSummary: any;
    try {
        const { userId } = await auth();
        if (!userId) {
            return {
                success: false,
                message: 'User not found',
            };
        }

        console.log('Saving PDF summary to database...');
        savedSummary = await savedPdfSummary({
            userId,
            fileUrl,
            summary,
            title,
            fileName,
            wordCount,
            originalText,
        });

        if (!savedSummary) {
            return {
                success: false,
                message: 'Failed to save PDF summary, please try again...',
            };
        }

        console.log('PDF summary saved successfully, ID:', savedSummary.id);
    } catch (error) {
        console.error('Error in storePdfSummaryAction:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error saving PDF summary',
        };
    }

    // Revalidate cache
    revalidatePath(`/summaries/${savedSummary.id}`);

    return {
        success: true,
        message: 'PDF summary saved successfully',
        data: {
            id: savedSummary.id,
        }
    };
}