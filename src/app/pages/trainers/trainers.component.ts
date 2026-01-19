import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TrainerService, Trainer } from '../../services/trainer.service';

interface DisplayTrainer {
  id: string;
  name: string;
  avatar: string;
  designation: string;
  experience: string;
  specialization: string;
  rating: number;
  students: number;
  description: string;
  skills: string[];
}

@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trainers.component.html',
  styleUrls: ['./trainers.component.css']
})
export class TrainersComponent implements OnInit {
  trainers: DisplayTrainer[] = [];
  loading = true;
  error: string | null = null;

  certifications = [
    { icon: 'certified', title: 'RTO Certified', description: 'All trainers are certified by Regional Transport Office' },
    { icon: 'licensed', title: 'Licensed Professionals', description: 'Valid driving licenses and instructor permits' },
    { icon: 'training', title: 'Continuous Training', description: 'Regular skill upgrades and workshops' },
    { icon: 'quality', title: 'Quality Assured', description: 'Monitored performance and student feedback' }
  ];

  stats = [
    { number: '0', label: 'Expert Trainers' },
    { number: '0', label: 'Students Trained' },
    { number: '0/5', label: 'Average Rating' },
    { number: '100%', label: 'Success Rate' }
  ];

  trainingApproach = [
    { step: '1', title: 'Assessment', description: 'Initial skill evaluation and goal setting' },
    { step: '2', title: 'Personalized Plan', description: 'Customized training schedule based on needs' },
    { step: '3', title: 'Practical Training', description: 'Hands-on sessions with real-world scenarios' },
    { step: '4', title: 'Continuous Feedback', description: 'Regular progress reviews and improvements' },
    { step: '5', title: 'Test Preparation', description: 'Mock tests and final readiness assessment' }
  ];

  qualities = [
    'Patient and understanding approach',
    'Clear and effective communication',
    'Focus on safety and best practices',
    'Adapts to individual learning pace',
    'Positive and encouraging attitude',
    'Real-world experience sharing'
  ];

  selectedTrainer: DisplayTrainer | null = null;

  constructor(private trainerService: TrainerService) {}

  async ngOnInit() {
    await this.loadTrainers();
  }

  async loadTrainers() {
    this.loading = true;
    this.error = null;
    try {
      const backendTrainers = await this.trainerService.getActiveTrainers();
      this.trainers = this.mapTrainersToDisplay(backendTrainers);
      this.updateStats();
    } catch (error: any) {
      console.error('Error loading trainers:', error);
      this.error = 'Failed to load trainers. Please try again later.';
      this.trainers = [];
    } finally {
      this.loading = false;
    }
  }

  private mapTrainersToDisplay(backendTrainers: Trainer[]): DisplayTrainer[] {
    return backendTrainers.map(trainer => {
      // Get designation based on experience
      let designation = 'Instructor';
      if (trainer.experience_years >= 15) {
        designation = 'Master Instructor';
      } else if (trainer.experience_years >= 12) {
        designation = 'Senior Instructor';
      } else if (trainer.experience_years >= 10) {
        designation = 'Lead Trainer';
      } else if (trainer.experience_years >= 8) {
        designation = 'Senior Trainer';
      }

      // Get avatar - use emoji if no avatar_url, or use first letter
      let avatar = '👨‍🏫';
      if (trainer.profile?.avatar_url) {
        avatar = trainer.profile.avatar_url;
      } else if (trainer.profile?.full_name) {
        // Use first letter as avatar if no image
        avatar = trainer.profile.full_name.charAt(0).toUpperCase();
      }

      // Get specialization - join array or use first item
      const specialization = trainer.specialization && trainer.specialization.length > 0
        ? trainer.specialization.join(', ')
        : 'General Training';

      // Use specialization as skills, or create default skills
      const skills = trainer.specialization && trainer.specialization.length > 0
        ? trainer.specialization
        : ['General Training', 'Safety Training', 'Basic Skills'];

      return {
        id: trainer.id,
        name: trainer.profile?.full_name || 'Trainer',
        avatar: avatar,
        designation: designation,
        experience: `${trainer.experience_years} Years`,
        specialization: specialization,
        rating: parseFloat(trainer.rating?.toString() || '0') || 0,
        students: trainer.total_sessions || 0,
        description: trainer.bio || 'Experienced trainer dedicated to your success',
        skills: skills
      };
    });
  }

  private updateStats() {
    if (this.trainers.length === 0) return;

    const totalTrainers = this.trainers.length;
    const totalStudents = this.trainers.reduce((sum, t) => sum + t.students, 0);
    const avgRating = this.trainers.reduce((sum, t) => sum + t.rating, 0) / totalTrainers;

    this.stats = [
      { number: `${totalTrainers}+`, label: 'Expert Trainers' },
      { number: `${totalStudents}+`, label: 'Students Trained' },
      { number: `${avgRating.toFixed(1)}/5`, label: 'Average Rating' },
      { number: '95%', label: 'Success Rate' }
    ];
  }

  openTrainerDetails(trainer: DisplayTrainer) {
    this.selectedTrainer = trainer;
  }

  closeTrainerDetails() {
    this.selectedTrainer = null;
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }
}
