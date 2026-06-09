export interface ArtStyleConfig {
  id: string;
  label: string;
  description: string;
  previewUrl: string;
  replicateModel: string;
  replicateVersion: string;
  defaultInput: Record<string, unknown>;
}

// IDs must match the ArtStyle union in apps/client/src/lib/customizer/types.ts
export const ART_STYLES: ArtStyleConfig[] = [
  {
    id: 'watercolor',
    label: 'Watercolor',
    description: 'Soft watercolor painting effect',
    previewUrl: 'https://cdn.mapleloomhandmade.com/art-styles/watercolor-preview.jpg',
    replicateModel: 'stability-ai/stable-diffusion-img2img',
    replicateVersion: 'a9758cbfbd5f3c2094457d996681af52552901e2b7b774b9f0e7b8e4c0bc0ea7',
    defaultInput: {
      prompt: 'watercolor painting, soft brushstrokes, pastel colors, artistic',
      negative_prompt: 'photo, realistic, digital art',
      strength: 0.65,
      guidance_scale: 7.5,
      num_inference_steps: 30,
    },
  },
  {
    id: 'van_gogh',
    label: 'Van Gogh',
    description: 'Swirling brushstrokes like Van Gogh',
    previewUrl: 'https://cdn.mapleloomhandmade.com/art-styles/van-gogh-preview.jpg',
    replicateModel: 'stability-ai/stable-diffusion-img2img',
    replicateVersion: 'a9758cbfbd5f3c2094457d996681af52552901e2b7b774b9f0e7b8e4c0bc0ea7',
    defaultInput: {
      prompt: 'Van Gogh style, swirling brushstrokes, post-impressionism, starry night',
      strength: 0.70,
      guidance_scale: 8,
      num_inference_steps: 35,
    },
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    description: 'Bold outlines, flat colors cartoon style',
    previewUrl: 'https://cdn.mapleloomhandmade.com/art-styles/cartoon-preview.jpg',
    replicateModel: 'stability-ai/stable-diffusion-img2img',
    replicateVersion: 'a9758cbfbd5f3c2094457d996681af52552901e2b7b774b9f0e7b8e4c0bc0ea7',
    defaultInput: {
      prompt: 'cartoon illustration, bold outlines, flat colors, Disney Pixar style',
      strength: 0.75,
      guidance_scale: 9,
      num_inference_steps: 30,
    },
  },
  {
    id: 'realistic',
    label: 'Realistic',
    description: 'Hyper-realistic photo enhancement',
    previewUrl: 'https://cdn.mapleloomhandmade.com/art-styles/realistic-preview.jpg',
    replicateModel: 'stability-ai/stable-diffusion-img2img',
    replicateVersion: 'a9758cbfbd5f3c2094457d996681af52552901e2b7b774b9f0e7b8e4c0bc0ea7',
    defaultInput: {
      prompt: 'photorealistic, ultra detailed, 8k, professional photography, sharp focus',
      negative_prompt: 'painting, sketch, cartoon, art',
      strength: 0.45,
      guidance_scale: 7,
      num_inference_steps: 30,
    },
  },
  {
    id: 'sketch',
    label: 'Pencil Sketch',
    description: 'Black and white pencil drawing',
    previewUrl: 'https://cdn.mapleloomhandmade.com/art-styles/sketch-preview.jpg',
    replicateModel: 'stability-ai/stable-diffusion-img2img',
    replicateVersion: 'a9758cbfbd5f3c2094457d996681af52552901e2b7b774b9f0e7b8e4c0bc0ea7',
    defaultInput: {
      prompt: 'pencil sketch, black and white, detailed linework, hand drawn',
      negative_prompt: 'color, photo, digital',
      strength: 0.70,
      guidance_scale: 7,
      num_inference_steps: 25,
    },
  },
];

export const ART_STYLE_IDS = new Set(ART_STYLES.map((s) => s.id));
