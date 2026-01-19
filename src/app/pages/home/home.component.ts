import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  features = [
    { icon: 'expert', title: 'Expert Training', description: 'Learn from certified professionals with years of experience' },
    { icon: 'safety', title: 'Safety First', description: 'Comprehensive safety protocols and protective gear provided' },
    { icon: 'flexible', title: 'Flexible Timing', description: 'Choose from various time slots that fit your schedule' },
    { icon: 'license', title: 'License Support', description: 'Complete assistance in obtaining your driving license' }
  ];

  stats = [
    { number: '2000+', label: 'Students Trained' },
    { number: '95%', label: 'Success Rate' },
    { number: '15+', label: 'Expert Trainers' },
    { number: '10+', label: 'Years Experience' }
  ];

  testimonials = [
    { name: 'Amit Kumar', rating: 5, text: 'Excellent training experience! The instructors are very patient and knowledgeable.', initial: 'AK' },
    { name: 'Priya Singh', rating: 5, text: 'Got my license on the first attempt. Highly recommend Kolkata Scotty!', initial: 'PS' },
    { name: 'Raj Sharma', rating: 5, text: 'Professional training with focus on safety. Worth every penny!', initial: 'RS' }
  ];

  whyChooseUs = [
    { title: 'Certified Trainers', description: 'All our trainers are certified and experienced professionals', icon: 'certified' },
    { title: 'Modern Bikes', description: 'Learn on well-maintained, modern bikes suitable for beginners', icon: 'bike' },
    { title: 'Affordable Pricing', description: 'Competitive pricing with flexible payment options', icon: 'pricing' },
    { title: 'Personalized Learning', description: 'Customized training plans based on your skill level', icon: 'learning' },
    { title: 'Safety Equipment', description: 'Helmets, guards, and safety gear provided during training', icon: 'equipment' },
    { title: 'License Assistance', description: 'Complete support for license application and tests', icon: 'assistance' }
  ];
}
