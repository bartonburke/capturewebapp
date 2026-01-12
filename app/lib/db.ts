// IndexedDB utilities for ChoraGraph Capture PWA

import { Project, PhotoMetadata, AudioMetadata, ProcessingResult } from './types';

const DB_NAME = 'choragraph-capture';
const DB_VERSION = 3;

// Initialize database
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
      }

      // Create photos store
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('projectId', 'projectId', { unique: false });
        photoStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create audio store
      if (!db.objectStoreNames.contains('audio')) {
        const audioStore = db.createObjectStore('audio', { keyPath: 'id' });
        audioStore.createIndex('projectId', 'projectId', { unique: false });
        audioStore.createIndex('sessionId', 'sessionId', { unique: false });
        audioStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create processing_results store (v3)
      if (!db.objectStoreNames.contains('processing_results')) {
        const resultsStore = db.createObjectStore('processing_results', { keyPath: 'id' });
        resultsStore.createIndex('projectId', 'projectId', { unique: false });
        resultsStore.createIndex('sessionId', 'sessionId', { unique: false });
        resultsStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Project CRUD operations
export async function createProject(project: Project): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('projects', 'readwrite');
  await tx.objectStore('projects').add(project);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await initDB();
  const tx = db.transaction('projects', 'readonly');
  const store = tx.objectStore('projects');
  const index = store.index('modifiedAt');

  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, 'prev'); // Sort by most recent
    const projects: Project[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        projects.push(cursor.value);
        cursor.continue();
      } else {
        resolve(projects);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await initDB();
  const tx = db.transaction('projects', 'readonly');
  const request = tx.objectStore('projects').get(id);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function updateProject(project: Project): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('projects', 'readwrite');
  await tx.objectStore('projects').put(project);
}

// Photo CRUD operations
export async function savePhoto(photo: PhotoMetadata): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('photos', 'readwrite');
  await tx.objectStore('photos').add(photo);
}

export async function getProjectPhotos(projectId: string): Promise<PhotoMetadata[]> {
  const db = await initDB();
  const tx = db.transaction('photos', 'readonly');
  const index = tx.objectStore('photos').index('projectId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Audio CRUD operations
export async function saveAudio(audio: AudioMetadata): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('audio', 'readwrite');
  await tx.objectStore('audio').add(audio);
}

export async function getProjectAudio(projectId: string): Promise<AudioMetadata[]> {
  const db = await initDB();
  const tx = db.transaction('audio', 'readonly');
  const index = tx.objectStore('audio').index('projectId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSessionAudio(sessionId: string): Promise<AudioMetadata | null> {
  const db = await initDB();
  const tx = db.transaction('audio', 'readonly');
  const index = tx.objectStore('audio').index('sessionId');

  return new Promise((resolve, reject) => {
    const request = index.get(sessionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Delete operations
export async function deleteProject(projectId: string): Promise<void> {
  const db = await initDB();

  // Delete all photos for this project
  const photos = await getProjectPhotos(projectId);
  for (const photo of photos) {
    await deletePhoto(photo.id);
  }

  // Delete all audio for this project
  const audio = await getProjectAudio(projectId);
  for (const audioRecord of audio) {
    await deleteAudio(audioRecord.id);
  }

  // Delete the project itself
  const tx = db.transaction('projects', 'readwrite');
  await tx.objectStore('projects').delete(projectId);
}

export async function deletePhoto(photoId: string): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('photos', 'readwrite');
  await tx.objectStore('photos').delete(photoId);
}

export async function deleteAudio(audioId: string): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('audio', 'readwrite');
  await tx.objectStore('audio').delete(audioId);
}

// Processing Results CRUD operations
export async function saveProcessingResult(result: ProcessingResult): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('processing_results', 'readwrite');
  await tx.objectStore('processing_results').add(result);
}

export async function updateProcessingResult(result: ProcessingResult): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('processing_results', 'readwrite');
  await tx.objectStore('processing_results').put(result);
}

export async function getSessionProcessingResult(sessionId: string): Promise<ProcessingResult | null> {
  const db = await initDB();
  const tx = db.transaction('processing_results', 'readonly');
  const index = tx.objectStore('processing_results').index('sessionId');

  return new Promise((resolve, reject) => {
    const request = index.get(sessionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectProcessingResults(projectId: string): Promise<ProcessingResult[]> {
  const db = await initDB();
  const tx = db.transaction('processing_results', 'readonly');
  const index = tx.objectStore('processing_results').index('projectId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProcessingResult(id: string): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('processing_results', 'readwrite');
  await tx.objectStore('processing_results').delete(id);
}
