import { Routes } from '@angular/router';
import { UploadComponent } from './upload/upload.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'upload' },
  { path: 'upload', component: UploadComponent },
];
