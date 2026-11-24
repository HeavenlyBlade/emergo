/**
 * Ambient module declarations for mobile when node_modules/firebase lacks .d.ts files.
 */
declare module 'firebase/app' {
  export function initializeApp(options: Record<string, any>, name?: string): any;
  export function getApps(): any[];
  export function getApp(name?: string): any;
}

declare module 'firebase/firestore' {
  export type Unsubscribe = () => void;

  export class Timestamp {
    readonly seconds?: number;
    readonly nanoseconds?: number;
    toDate(): Date;
    toMillis?(): number;
    static fromDate(date: Date): Timestamp;
    static now(): Timestamp;
  }

  export class GeoPoint {
    readonly latitude: number;
    readonly longitude: number;
    constructor(latitude: number, longitude: number);
  }

  export function getFirestore(app?: any): any;
  export function collection(firestore: any, path: string, ...pathSegments: string[]): any;
  export function doc(firestore: any, path: string, ...pathSegments: string[]): any;
  export function getDoc(reference: any): Promise<any>;
  export function getDocs(query: any): Promise<any>;
  export function setDoc(reference: any, data: any, options?: any): Promise<void>;
  export function addDoc(reference: any, data: any): Promise<any>;
  export function updateDoc(reference: any, data: any): Promise<void>;
  export function deleteDoc(reference: any): Promise<void>;
  export function runTransaction(firestore: any, updateFunction: (transaction: any) => Promise<any>): Promise<any>;
  export function onSnapshot(reference: any, onNext: (snapshot: any) => void, onError?: (error: any) => void): Unsubscribe;
  export function query(query: any, ...queryConstraints: any[]): any;
  export function where(fieldPath: string, opStr: string, value: any): any;
  export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): any;
  export function limit(limit: number): any;
  export function serverTimestamp(): any;
}

declare module 'expo-device' {
  export const isDevice: boolean;
}
