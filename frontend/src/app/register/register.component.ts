import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  username = '';
  password = '';
  firstName = '';
  lastName = '';
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  register() {
    const userData = {
      username: this.username,
      password: this.password,
      first_name: this.firstName,
      last_name: this.lastName
    };
    this.authService.register(userData)
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.error = err?.error?.detail || 'Registration failed';
        }
      });
  }
}
