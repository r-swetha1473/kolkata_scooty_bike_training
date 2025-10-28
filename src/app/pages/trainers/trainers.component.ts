import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trainers.component.html',
  styleUrls: ['./trainers.component.css']
})
export class TrainersComponent {
  trainers = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      avatar: '👨‍🏫',
      designation: 'Senior Instructor',
      experience: '12 Years',
      specialization: 'Beginner Training',
      rating: 4.9,
      students: 500,
      description: 'Expert in teaching beginners with patience and precision',
      skills: ['Safety Training', 'Basic Skills', 'License Prep']
    },
    {
      id: 2,
      name: 'Anita Sharma',
      avatar: '👩‍🏫',
      designation: 'Lead Trainer',
      experience: '10 Years',
      specialization: 'Advanced Techniques',
      rating: 4.8,
      students: 450,
      description: 'Specializes in advanced riding skills and defensive techniques',
      skills: ['Advanced Riding', 'Highway Training', 'Emergency Response']
    },
    {
      id: 3,
      name: 'Vikram Singh',
      avatar: '👨‍🏫',
      designation: 'Master Instructor',
      experience: '15 Years',
      specialization: 'All Levels',
      rating: 5.0,
      students: 650,
      description: 'Versatile trainer with expertise across all skill levels',
      skills: ['All-Round Training', 'Confidence Building', 'Test Preparation']
    },
    {
      id: 4,
      name: 'Priya Banerjee',
      avatar: '👩‍🏫',
      designation: 'Senior Trainer',
      experience: '8 Years',
      specialization: 'Women Training',
      rating: 4.9,
      students: 400,
      description: 'Dedicated trainer for women-only batches',
      skills: ['Women-Focused', 'Confidence Training', 'City Riding']
    },
    {
      id: 5,
      name: 'Amit Das',
      avatar: '👨‍🏫',
      designation: 'Instructor',
      experience: '7 Years',
      specialization: 'Traffic Management',
      rating: 4.7,
      students: 350,
      description: 'Expert in teaching traffic rules and city navigation',
      skills: ['Traffic Rules', 'City Navigation', 'Defensive Driving']
    },
    {
      id: 6,
      name: 'Sneha Roy',
      avatar: '👩‍🏫',
      designation: 'Instructor',
      experience: '6 Years',
      specialization: 'Refresher Training',
      rating: 4.8,
      students: 300,
      description: 'Helps experienced riders improve their skills',
      skills: ['Skill Enhancement', 'Refresher Courses', 'Advanced Safety']
    }
  ];

  certifications = [
    { icon: '🏆', title: 'RTO Certified', description: 'All trainers are certified by Regional Transport Office' },
    { icon: '📜', title: 'Licensed Professionals', description: 'Valid driving licenses and instructor permits' },
    { icon: '🎓', title: 'Continuous Training', description: 'Regular skill upgrades and workshops' },
    { icon: '⭐', title: 'Quality Assured', description: 'Monitored performance and student feedback' }
  ];

  stats = [
    { number: '15+', label: 'Expert Trainers' },
    { number: '3500+', label: 'Students Trained' },
    { number: '4.8/5', label: 'Average Rating' },
    { number: '95%', label: 'Success Rate' }
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

  selectedTrainer: any = null;

  openTrainerDetails(trainer: any) {
    this.selectedTrainer = trainer;
  }

  closeTrainerDetails() {
    this.selectedTrainer = null;
  }
}
