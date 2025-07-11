'use client';

import { useUploadThing } from '@/utils/uploadthing';
import UploadFormInput from './upload-form-input';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  generatePdfSummary,
  generatePdfText,
  storePdfSummaryAction,
} from '@/actions/upload-actions';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSkeleton from './loading-skeleton';
import { formatFileNameAsTitle } from '@/utils/format-utils';

const schema = z.object({
  file: z
    .instanceof(File, { message: 'Invalid file' })
    .refine((file) => file.size <= 20 * 1024 * 1024, 'File size must be less than 20MB')
    .refine((file) => file.type.startsWith('application/pdf'), 'File must be a PDF'),
});

export default function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { startUpload } = useUploadThing('pdfUploader', {
    onClientUploadComplete: () => {
      console.log('uploaded successfully!');
    },
    onUploadError: (err) => {
      console.error('error occurred while uploading', err);
      toast.error(`❌ Upload error: ${err.message}`);
      setIsLoading(false);
    },
    onUploadBegin: ({ file }) => {
      console.log('upload has begun for', file);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      toast.error('❌ Request timed out. Please try with a smaller file.');
      setIsLoading(false);
    }, 300000); // 5 minutes timeout

    try {
      setIsLoading(true);
      const formData = new FormData(e.currentTarget);
      const file = formData.get('file');

      if (!(file instanceof File)) {
        toast.error('❌ Uploaded data is not a valid file.');
        setIsLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      const validatedFields = schema.safeParse({ file });

      if (!validatedFields.success) {
        toast.error(
          `❌ Something went wrong: ${
            validatedFields.error.flatten().fieldErrors.file?.[0] ?? 'Invalid file'
          }`
        );
        setIsLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      toast.loading('📄 Uploading PDF...', {
        description: 'Please wait while we upload your file',
        id: 'upload-progress',
      });

      const resp = await startUpload([file]);

      if (!resp || resp.length === 0) {
        toast.error('❌ Upload failed. Please try again with a different file.');
        setIsLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      const uploadData = resp[0];
      console.log('Upload data:', uploadData); // Debug log

      toast.loading('🤖 Processing PDF...', {
        description: 'Our AI is analyzing your document',
        id: 'upload-progress',
      });

      // ✅ Pass [uploadData] instead of single object
      const result = await generatePdfSummary([uploadData]);

      if (abortController.signal.aborted) {
        toast.error('❌ Request was cancelled due to timeout');
        return;
      }

      const { data = null, message = null } = result || {};

      if (!data) {
        toast.error(`❌ Processing failed: ${message || 'Unknown error'}`);
        setIsLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      if (data.summary) {
        const formattedFileName = formatFileNameAsTitle(file.name);

        // ✅ Use ufsUrl instead of deprecated url property
        const fileUrl = uploadData.serverData?.file?.ufsUrl || uploadData.serverData?.file?.url;
        
        if (!fileUrl) {
          toast.error('❌ File URL not found in upload response');
          setIsLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        // ✅ Pass both fileUrl and fileName
        const pdfText = await generatePdfText({
          fileUrl: fileUrl,
          fileName: file.name,
        });

        toast.loading('💾 Saving summary...', {
          description: 'Almost done!',
          id: 'upload-progress',
        });

        // ✅ Prepare data for storage
        const storeData = {
          summary: data.summary,
          fileUrl: fileUrl,
          title: formattedFileName,
          fileName: file.name,
        };

        console.log('Store data:', storeData); // Debug log

        try {
          const storeResults = await storePdfSummaryAction(storeData);

          console.log('Store results:', storeResults); // Debug log

          if (storeResults?.success && storeResults?.data?.id) {
            toast.success('🌟 Summary Generated!', {
              description: 'Your PDF has been successfully summarized and saved!',
              id: 'upload-progress',
            });

            formRef.current?.reset();
            router.push(`/summaries/${storeResults.data.id}`);
          } else {
            console.error('Store results error:', storeResults);
            toast.error(`❌ Failed to save summary: ${storeResults?.message || 'Unknown error'}`);
          }
        } catch (storeError) {
          console.error('Storage error:', storeError);
          toast.error(`❌ Failed to save summary: ${storeError.message || 'Database error'}`);
        }
      } else {
        toast.error('❌ No summary generated. Please try again.');
      }
    } catch (error) {
      console.error('Error occurred:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('❌ Request was cancelled');
        } else if (
          error.message.includes('fetch failed') ||
          error.message.includes('timeout')
        ) {
          toast.error(
            '❌ Connection timeout. Please check your internet connection and try again.'
          );
        } else {
          toast.error(`❌ Error: ${error.message}`);
        }
      } else {
        toast.error('❌ An unexpected error occurred. Please try again.');
      }

      formRef.current?.reset();
    } finally {
      setIsLoading(false);
      clearTimeout(timeoutId);
      toast.dismiss('upload-progress');
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200 dark:border-gray-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-muted-foreground text-sm">
            Upload PDF
          </span>
        </div>
      </div>

      <UploadFormInput isLoading={isLoading} ref={formRef} onSubmit={handleSubmit} />

      {isLoading && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-muted-foreground text-sm">
                Processing
              </span>
            </div>
          </div>
          <LoadingSkeleton />
        </>
      )}
    </div>
  );
}