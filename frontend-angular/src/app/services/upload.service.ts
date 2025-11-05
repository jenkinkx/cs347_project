import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// If using environments, import from your environment file.
// Otherwise, hardcode or inject via APP_INITIALIZER.
const API_BASE = (window as any).API_BASE || 'http://127.0.0.1:8000/api';

export interface PostDto {
  id: number;
  group_id: number;
  user_name: string;
  caption: string;
  image_url: string;
  date: string; // ISO date
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  uploadPost(params: {
    image: File;
    caption?: string;
    groupId: number | string;
    userName: string;
  }): Observable<PostDto> {
    const form = new FormData();
    form.append('image', params.image);
    form.append('caption', params.caption ?? '');
    form.append('group_id', String(params.groupId));
    form.append('user_name', params.userName);
    return this.http.post<PostDto>(`${API_BASE}/posts/upload/`, form);
  }
}

