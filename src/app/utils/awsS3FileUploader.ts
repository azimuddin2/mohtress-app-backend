import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import config from '../config';
import { s3Client } from '../constant/aws';
import AppError from '../errors/AppError';

//upload a single file
export const uploadToS3 = async ({
  file,
  fileName,
}: {
  file: any;
  fileName: string;
}): Promise<string | null> => {
  const fileExtention = file.originalname.split('.').pop();
  const command = new PutObjectCommand({
    Bucket: config.aws_bucket,
    Key: `${fileName}.${fileExtention}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  try {
    const key = await s3Client.send(command);
    if (!key) {
      throw new AppError(400, 'File Upload failed');
    }

    const url = `https://${config.aws_bucket}.s3.${config.aws_region}.amazonaws.com/${fileName}.${fileExtention}`;

    return url;
  } catch (error) {
    throw new AppError(400, 'File Upload failed');
  }
};

// delete file from s3 bucket
export const deleteFromS3 = async (url: string) => {
  try {
    const urlObj = new URL(url);
    const key = urlObj?.pathname;
    console.log(key);
    const command = new DeleteObjectCommand({
      Bucket: config.aws_bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.log('🚀 ~ deleteFromS3 ~ error:', error);
    throw new Error('s3 file delete failed');
  }
};

// upload multiple files
export const uploadManyToS3 = async (
  files: {
    file: Express.Multer.File;
    path: string;
    key?: string;
    extension?: string;
  }[],
): Promise<{ url: string; key: string }[]> => {
  try {
    const uploadPromises = files?.map(async ({ file, path, key }) => {
      const newFileName = key
        ? key
        : `${Math.floor(100000 + Math.random() * 900000)}${Date.now()}`;

      const fileKey = `${path}/${newFileName}`;
      const command = new PutObjectCommand({
        Bucket: config.aws_bucket as string,
        Key: fileKey,
        Body: file?.buffer,
      });

      await s3Client.send(command);

      const url = `https://${config.aws_bucket}.s3.${config.aws_region}.amazonaws.com/${fileKey}`;
      return { url, key: newFileName };
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    return uploadedUrls;
  } catch (error) {
    throw new Error('File Upload failed');
  }
};

// delete multiple files
export const deleteManyFromS3 = async (keys: string[]) => {
  try {
    const rawObjects = keys.map((key) => {
      try {
        if (key.startsWith('http://') || key.startsWith('https://')) {
          const urlObj = new URL(key);
          const fileKey = urlObj.pathname.startsWith('/')
            ? urlObj.pathname.slice(1)
            : urlObj.pathname;
          return { Key: fileKey };
        }
        return { Key: key };
      } catch (err) {
        console.warn(`Invalid key or URL skipped: ${key}`);
        return null;
      }
    });

    const Objects: { Key: string }[] = rawObjects.filter(
      (obj): obj is { Key: string } => obj !== null,
    );

    if (!Objects.length) {
      throw new AppError(400, 'No valid S3 keys to delete');
    }

    const deleteParams = {
      Bucket: config.aws_bucket,
      Delete: {
        Objects,
        Quiet: false,
      },
    };

    const command = new DeleteObjectsCommand(deleteParams);
    const response = await s3Client.send(command);

    return response;
  } catch (error) {
    console.error('Error deleting S3 files:', error);
    throw new AppError(400, 'S3 file delete failed');
  }
};
