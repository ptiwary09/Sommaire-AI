'use client';

import { useUploadThing } from '@/utils/uploadthing';
import UploadFormInput from './upload-form-input';
import { z } from 'zod';
import { toast } from 'sonner';
import { generatePdfSummary, storePdfSummaryAction } from '@/actions/upload-actions';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const schema = z.object({
  file: z
    .instanceof(File, { message: 'Invalid file' })
    .refine((file) => file.size <= 20 * 1024 * 1024, 'File size must be less than 20MB')
    .refine((file) => file.type.startsWith('application/pdf'), 'File must be a PDF'),
});

export default function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] =useState(false);
  const router = useRouter();


  const { startUpload, routeConfig } = useUploadThing('pdfUploader', {
    onClientUploadComplete: () => {
      console.log('uploaded successfully!');
    },
    onUploadError: (err) => {
      console.error('error occurred while uploading', err);
      toast.error(`❌ Upload error\n${err.message}`);
    },
    onUploadBegin: ({ file }) => {
      console.log('upload has begun for', file);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsLoading(true);
     const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    const validatedFields = schema.safeParse({ file });

    if (!validatedFields.success) {
      toast.error(
        `❌ Something went wrong\n${
          validatedFields.error.flatten().fieldErrors.file?.[0] ?? 'Invalid file'
        }`
      );
      setIsLoading(false);
      return; 
    }

    
   toast(
  <div>
   <p className="text-base font-bold">📄Uploading PDF</p>

    <p className="text-sm text-muted-foreground">
      We are uploading your pdf ✨
    </p>
  </div>
);

    const resp = await startUpload([file]);
    if (!resp) {
      toast.error('❌ Upload failed\nPlease use a different file.');
      return;
    }

   toast(
  <div>
   <p className="text-base font-bold">📄 Processing PDF</p>

    <p className="text-sm text-muted-foreground">
      Hang tight! Our AI is reading your document ✨
    </p>
  </div>
);

const result = await generatePdfSummary(resp);

const { data=null, message = null } = result || {};
if(data) {
  let storeResults: any;
  toast(
  <div>
   <p className="text-base font-bold">📄 Saving PDF...</p>

    <p className="text-sm text-muted-foreground">
      Hang tight! We are saving your summary! ✨
    </p>
  </div>
);
 


 if(data.summary) {
 storeResults=await storePdfSummaryAction({
  summary: data.summary,
  fileUrl:resp[0].serverData.file.url,
  title: data.title,
  fileName: file.name,
 });
 toast(
  <div>
   <p className="text-base font-bold">🌟 Summary Generated!</p>

    <p className="text-sm text-muted-foreground">
      Your PDF has been successfully summarized and saved!✨,
    </p>
  </div>
);
 
formRef.current?.reset();
// todo: redirect to the [id] summary page
router.push(`/summaries/${storeResults.data.id}`);
}
}
} catch(error) {
      setIsLoading(false);
      console.log('ErrorOccured',error);
      formRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      <UploadFormInput isLoading={isLoading}  ref={formRef} onSubmit={handleSubmit} />
    </div>
  );
}
