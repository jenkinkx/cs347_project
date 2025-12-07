import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ApiService, GroupDto, PostDto } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  groups: GroupDto[] = [];
  posts: PostDto[] = [];
  selectedGroupId: number | null = null;
  searchTerm: string = '';
  private searchSubject = new Subject<string>();

  count: number = 0;
  currentPage: number = 1;
  Math = Math;
  currentUsername: string | null = null;
  selectedPostIds: number[] = [];

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.currentUsername = this.authService.getCurrentUsername();
    this.loadGroups();
    this.searchSubject.pipe(
      debounceTime(300)
    ).subscribe(searchValue => {
      this.currentPage = 1;
      this.loadPosts(this.selectedGroupId, searchValue, this.currentPage);
    });
  }

  isAuthor(post: PostDto): boolean {
    return this.currentUsername === post.author;
  }

  loadGroups() {
    this.apiService.getGroups().subscribe(groups => {
      this.groups = groups;
      if (groups.length > 0) {
        this.selectGroup(groups[0].id);
      }
    });
  }

  loadPosts(groupId: number | null, search: string = '', page: number = 1) {
    if (!groupId) return;
    this.apiService.getPosts({ groupId, search, page }).subscribe(response => {
      this.posts = response.results;
      this.count = response.count;
      this.currentPage = page;
      this.clearSelection(); // Clear selection on new posts load
    });
  }

  selectGroup(groupId: number) {
    this.selectedGroupId = groupId;
    this.currentPage = 1;
    this.loadPosts(groupId, this.searchTerm, this.currentPage);
  }

  onSearchChange(searchValue: string): void {
    this.searchTerm = searchValue;
    this.searchSubject.next(searchValue);
  }

  nextPage() {
    if (this.currentPage * 10 < this.count) {
      this.loadPosts(this.selectedGroupId, this.searchTerm, this.currentPage + 1);
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.loadPosts(this.selectedGroupId, this.searchTerm, this.currentPage - 1);
    }
  }

  togglePostSelection(postId: number) {
    const index = this.selectedPostIds.indexOf(postId);
    if (index > -1) {
      this.selectedPostIds.splice(index, 1);
    } else {
      this.selectedPostIds.push(postId);
    }
  }

  isPostSelected(postId: number): boolean {
    return this.selectedPostIds.includes(postId);
  }

  get isAllMyPostsSelected(): boolean {
    const myPostsOnPage = this.posts.filter(p => this.isAuthor(p));
    if (myPostsOnPage.length === 0) {
      return false;
    }
    return myPostsOnPage.every(p => this.selectedPostIds.includes(p.id));
  }

  selectAllPosts() {
    if (this.isAllMyPostsSelected) {
      this.clearSelection();
    } else {
      this.selectedPostIds = this.posts.filter(post => this.isAuthor(post)).map(post => post.id);
    }
  }

  clearSelection() {
    this.selectedPostIds = [];
  }

  bulkDeleteSelectedPosts() {
    if (this.selectedPostIds.length === 0) {
      alert('No posts selected for deletion.');
      return;
    }
    if (confirm(`Are you sure you want to delete ${this.selectedPostIds.length} selected posts?`)) {
      this.apiService.bulkDeletePosts(this.selectedPostIds).subscribe(() => {
        alert('Selected posts deleted successfully.');
        this.loadPosts(this.selectedGroupId, this.searchTerm, this.currentPage); // Reload current page
      });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  deletePost(postId: number) {
    if (confirm('Are you sure you want to delete this post?')) {
      this.apiService.deletePost(postId).subscribe(() => {
        this.posts = this.posts.filter(p => p.id !== postId);
        this.count--; // Decrement count for single delete
      });
    }
  }

  editPost(post: PostDto) {
    const newCaption = prompt('Enter new caption:', post.caption);
    if (newCaption !== null) {
      this.apiService.updatePost(post.id, { caption: newCaption }).subscribe(updatedPost => {
        const index = this.posts.findIndex(p => p.id === post.id);
        if (index !== -1) {
          this.posts[index] = updatedPost;
        }
      });
    }
  }

  downloadMyPosts() {
    this.apiService.exportMyPosts().subscribe(posts => {
      const dataStr = JSON.stringify(posts, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my_posts.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }
}
