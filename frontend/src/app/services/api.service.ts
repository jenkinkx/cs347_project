import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = (window as any).API_BASE || 'http://127.0.0.1:8000/api';

export interface GroupDto {
  id: number;
  name: string;
  owner: string;
  members: number[];
  color: string;
  description: string;
}

export interface PostDto {
  id: number;
  group: number;
  author: string;
  caption: string;
  image: string;
  date: string; // ISO date
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getGroups(): Observable<GroupDto[]> {
    return this.http.get<GroupDto[]>(`${API_BASE}/groups/`);
  }

  getPosts(params: { groupId?: number; search?: string; page?: number }): Observable<PaginatedResponse<PostDto>> {
    let url = new URL(`${API_BASE}/posts/`);
    if (params.groupId) {
      url.searchParams.append('group_id', String(params.groupId));
    }
    if (params.search) {
      url.searchParams.append('search', params.search);
    }
    if (params.page) {
      url.searchParams.append('page', String(params.page));
    }
    return this.http.get<PaginatedResponse<PostDto>>(url.toString());
  }

  uploadPost(params: {
    image: File;
    caption?: string;
    group: number | string;
  }): Observable<PostDto> {
    const form = new FormData();
    form.append('image', params.image);
    form.append('caption', params.caption ?? '');
    form.append('group', String(params.group));
    return this.http.post<PostDto>(`${API_BASE}/posts/`, form);
  }

  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/posts/${postId}/`);
  }

  updatePost(postId: number, data: Partial<PostDto>): Observable<PostDto> {
    return this.http.patch<PostDto>(`${API_BASE}/posts/${postId}/`, data);
  }

  getProfile(): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(`${API_BASE}/profile/`);
  }

  updateProfile(data: Partial<ProfileDto>): Observable<ProfileDto> {
    return this.http.put<ProfileDto>(`${API_BASE}/profile/`, data);
  }

  bulkDeletePosts(postIds: number[]): Observable<any> {
    return this.http.post<any>(`${API_BASE}/posts/bulk_delete/`, { post_ids: postIds });
  }

  exportMyPosts(): Observable<PostDto[]> {
    return this.http.get<PostDto[]>(`${API_BASE}/posts/export_my_posts/`);
  }
}

export interface ProfileDto {
  username: string;
  bio: string;
}
