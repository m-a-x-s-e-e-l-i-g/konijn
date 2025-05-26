// Interface for artwork metadata
export interface ArtworkMetadata {
  id: number;
  tags: string[];
  title?: string;  // Optional title for the artwork
  description?: string; // Optional description
}

// Artwork metadata collection
export const artworkCollection: ArtworkMetadata[] = [
  { id: 22, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 21, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 20, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 19, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 18, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 17, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 16, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 15, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 14, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 13, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 12, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 11, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 10, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass', 'SOLD'] },
  { id: 9, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 8, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass', 'SOLD'] },
  { id: 7, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 6, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 5, tags: ['canvas', '24x30cm', 'Frameless Anti-Reflective Glass'] },
  { id: 4, tags: ['paper', 'A4'] },
  { id: 3, tags: ['paper', 'A4'] },
  { id: 2, tags: ['canvas', '30x40cm'] },
  { id: 1, tags: ['cartboard', '26x27cm'] },
];

// Helper function to get artwork metadata by ID
export function getArtworkById(id: number): ArtworkMetadata | undefined {
  return artworkCollection.find(artwork => artwork.id === id);
}

// Get tag color based on tag name
export function getTagColor(tag: string): string {
  switch(tag) {
    case 'Frameless Anti-Reflective Glass':
      return 'text-gray-400';
    case 'canvas':
    case 'paper':
    case 'cartboard':
      return 'bg-black';
    case 'SOLD':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}
