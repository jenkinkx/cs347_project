import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ProfileDto } from '../services/api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profile: ProfileDto = { username: '', bio: '' };

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.apiService.getProfile().subscribe(profile => {
      this.profile = profile;
    });
  }

  saveProfile() {
    this.apiService.updateProfile(this.profile).subscribe(updatedProfile => {
      this.profile = updatedProfile;
      alert('Profile saved!');
    });
  }
}
