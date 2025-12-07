import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PostDto } from '../services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {
  selectedFile?: File;
  caption = '';
  groupId: number | null = null;
  uploading = false;
  result?: PostDto;
  error?: string;

  constructor(private apiService: ApiService) {}

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || undefined;
  }

  submit() {
    if (!this.selectedFile || !this.groupId) {
      this.error = 'Please choose a file and a group id.';
      return;
    }
    this.error = undefined;
    this.uploading = true;
    this.result = undefined;
    this.apiService
      .uploadPost({
        image: this.selectedFile,
        caption: this.caption,
        group: this.groupId,
      })
      .subscribe({
        next: (res) => {
          this.result = res;
          this.uploading = false;
        },
        error: (err) => {
          this.error = err?.error?.detail || 'Upload failed';
          this.uploading = false;
        },
      });
  }
}

