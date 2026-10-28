import { Crepe } from '@milkdown/crepe';
import { noteAssetRepo } from '@shared/db/repositories/noteAssetRepo';
import { assetRef, resolveAssetUrl } from '@shared/utils/noteAssets';
import { useToastStore } from '@shared/stores/toastStore';

type CrepeFeatureConfigs = NonNullable<
  NonNullable<ConstructorParameters<typeof Crepe>[0]>['featureConfigs']
>;

export type ImageFeatureConfig = NonNullable<
  CrepeFeatureConfigs[typeof Crepe.Feature.ImageBlock]
>;

/**
 * 图片资源接入：粘贴/拖拽/选择文件后把二进制存进本地资源表，
 * 正文里只保留 dock-asset:<id> 引用，随笔记一起同步与导出。
 */
async function uploadImage(file: File): Promise<string> {
  const toast = useToastStore();
  try {
    const asset = await noteAssetRepo.save(file, file.type);
    return assetRef(asset.id);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '图片插入失败');
    throw error;
  }
}

/** 渲染时把本地资源引用换成可显示的地址，外部图片链接原样返回 */
async function proxyImageUrl(url: string): Promise<string> {
  try {
    return await resolveAssetUrl(url);
  } catch {
    return '';
  }
}

export const imageFeatureConfig: ImageFeatureConfig = {
  onUpload: uploadImage,
  blockOnUpload: uploadImage,
  inlineOnUpload: uploadImage,
  proxyDomURL: proxyImageUrl,
  blockUploadButton: '选择图片',
  inlineUploadButton: '选择图片',
  blockConfirmButton: '确认',
  inlineConfirmButton: '确认',
  blockUploadPlaceholderText: '或粘贴图片链接',
  inlineUploadPlaceholderText: '或粘贴图片链接',
  onImageLoadError: () => {
    useToastStore().error('图片加载失败，可能已被删除');
  },
};
