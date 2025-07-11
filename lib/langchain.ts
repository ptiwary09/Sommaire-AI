// /lib/langchain.ts
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export async function fetchAndExtractPdfText(fileUrl: string): Promise<string> {
    try {
        console.log('🔍 Starting PDF extraction from URL:', fileUrl);
        
        // Validate URL
        if (!fileUrl || !fileUrl.startsWith('http')) {
            throw new Error(`Invalid PDF URL: ${fileUrl}`);
        }
        
        // Fetch the PDF
        const response = await fetch(fileUrl);
        console.log('📥 Fetch response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        console.log('📄 Content-Type:', contentType);
        
        if (contentType && !contentType.includes('application/pdf')) {
            console.warn('⚠️  Content-Type is not PDF:', contentType);
        }
        
        // Get the blob
        const blob = await response.blob();
        console.log('📦 Blob size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
            throw new Error('PDF file is empty (0 bytes)');
        }
        
        // Convert to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        console.log('🗂️  ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
        
        // Create PDF loader
        const loader = new PDFLoader(new Blob([arrayBuffer]));
        console.log('🚀 Loading PDF with LangChain...');
        
        // Load the documents
        const docs = await loader.load();
        console.log('📚 Number of pages loaded:', docs.length);
        
        if (docs.length === 0) {
            throw new Error('No pages could be loaded from PDF');
        }
        
        // Extract text from all pages
        const extractedText = docs.map((doc) => doc.pageContent).join('\n');
        console.log('📝 Total extracted text length:', extractedText.length);
        
        if (extractedText.length === 0) {
            throw new Error('No text could be extracted from PDF - document may be image-based or corrupted');
        }
        
        // Clean up the text (remove excessive whitespace)
        const cleanedText = extractedText.replace(/\s+/g, ' ').trim();
        
        // Log preview for debugging
        console.log('✅ PDF extraction successful!');
        console.log('📄 Text preview (first 200 chars):', cleanedText.substring(0, 200));
        console.log('📊 Final text length:', cleanedText.length);
        
        // Additional validation
        if (cleanedText.length < 10) {
            console.warn('⚠️  Extracted text is very short, may indicate extraction issues');
        }
        
        return cleanedText;
        
    } catch (error) {
        console.error('❌ PDF Extraction Error:', error);
        console.error('📍 Error occurred while processing:', fileUrl);
        
        // Provide more specific error messages
        if (error instanceof Error) {
            if (error.message.includes('fetch')) {
                throw new Error(`Failed to download PDF: ${error.message}`);
            } else if (error.message.includes('load')) {
                throw new Error(`Failed to parse PDF: ${error.message}`);
            } else {
                throw new Error(`PDF extraction failed: ${error.message}`);
            }
        }
        
        throw new Error('Unknown error occurred during PDF extraction');
    }
}

// Optional: Add a test function to debug specific PDFs
export async function testPdfExtraction(fileUrl: string) {
    console.log('\n=== PDF EXTRACTION TEST ===');
    try {
        const text = await fetchAndExtractPdfText(fileUrl);
        console.log('✅ SUCCESS: PDF extracted successfully');
        console.log('📊 Text length:', text.length);
        console.log('📝 First 500 characters:');
        console.log(text.substring(0, 500));
        console.log('=== END TEST ===\n');
        return text;
    } catch (error) {
        console.error('❌ FAILED: PDF extraction test failed');
        console.error('Error:', error);
        console.log('=== END TEST ===\n');
        throw error;
    }
}