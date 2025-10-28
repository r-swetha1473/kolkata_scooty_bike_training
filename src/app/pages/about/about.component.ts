import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent {
  milestones = [
    { year: '2014', title: 'Founded', description: 'Started with a vision to provide quality bike training' },
    { year: '2016', title: 'Expansion', description: 'Opened multiple training centers across Kolkata' },
    { year: '2019', title: 'Recognition', description: 'Awarded Best Driving School in West Bengal' },
    { year: '2023', title: 'Digital Era', description: 'Launched online booking and advanced training programs' }
  ];

  values = [
    { icon: '🎯', title: 'Excellence', description: 'Committed to delivering the highest quality training experience' },
    { icon: '🤝', title: 'Integrity', description: 'Honest and transparent in all our dealings' },
    { icon: '💡', title: 'Innovation', description: 'Continuously improving our methods and technology' },
    { icon: '❤️', title: 'Care', description: 'Genuinely caring about each student\'s success and safety' }
  ];

  achievements = [
    { title: '2000+ Students', description: 'Successfully trained and certified' },
    { title: '95% Success Rate', description: 'In first-time license tests' },
    { title: '15+ Trainers', description: 'Experienced and certified professionals' },
    { title: '4.9/5 Rating', description: 'Average customer satisfaction' }
  ];

  team = [
    { name: 'Rajesh Kumar', role: 'Founder & CEO', description: 'Visionary leader with 15+ years in training industry' },
    { name: 'Anita Sharma', role: 'Head Trainer', description: 'Expert in advanced riding techniques' },
    { name: 'Vikram Singh', role: 'Operations Manager', description: 'Ensuring smooth operations and quality' }
  ];

  features = [
    { icon: '✓', text: 'State-of-the-art training facilities' },
    { icon: '✓', text: 'Modern fleet of training bikes' },
    { icon: '✓', text: 'Flexible scheduling options' },
    { icon: '✓', text: 'Comprehensive safety training' },
    { icon: '✓', text: 'License exam preparation' },
    { icon: '✓', text: 'Post-training support' }
  ];
}
