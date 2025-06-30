// Helper function to clean objects before saving to Firestore
export function cleanFirestoreData(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (data instanceof Date) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }

  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned;
  }

  return data;
}