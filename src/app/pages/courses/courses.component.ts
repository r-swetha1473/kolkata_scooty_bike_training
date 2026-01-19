import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './courses.component.html',
  styleUrls: ['./courses.component.css']
})
export class CoursesComponent {
  courses = [
    {
      id: 1,
      name: 'Beginner Course',
      icon: 'beginner',
      duration: '2 Weeks',
      price: '₹3,999',
      features: ['Basic bike handling', 'Traffic rules', 'Safety training', 'Practice sessions', 'License preparation'],
      popular: false
    },
    {
      id: 2,
      name: 'Intermediate Course',
      icon: 'intermediate',
      duration: '3 Weeks',
      price: '₹5,999',
      features: ['Advanced techniques', 'City riding', 'Highway training', 'Emergency handling', 'Test preparation', 'Certificate'],
      popular: true
    },
    {
      id: 3,
      name: 'Advanced Course',
      icon: 'advanced',
      duration: '4 Weeks',
      price: '₹8,999',
      features: ['Professional skills', 'Long-distance riding', 'Night riding', 'Adverse conditions', 'Advanced safety', 'Premium support'],
      popular: false
    }
  ];

  benefits = [
    { icon: 'instructors', title: 'Expert Instructors', description: 'Learn from certified professionals' },
    { icon: 'bikes', title: 'Modern Bikes', description: 'Train on latest bike models' },
    { icon: 'schedule', title: 'Flexible Schedule', description: 'Choose your convenient time' },
    { icon: 'practical', title: 'Practical Focus', description: 'Hands-on training approach' }
  ];

  curriculum = [
    { module: 'Module 1', title: 'Introduction & Safety', topics: ['Bike components', 'Safety gear', 'Basic controls', 'Starting & stopping'] },
    { module: 'Module 2', title: 'Basic Riding', topics: ['Balance techniques', 'Turning & cornering', 'Gear shifting', 'Braking methods'] },
    { module: 'Module 3', title: 'Traffic Rules', topics: ['Road signs', 'Traffic signals', 'Right of way', 'Lane discipline'] },
    { module: 'Module 4', title: 'Advanced Skills', topics: ['City navigation', 'Highway riding', 'Emergency response', 'Defensive riding'] },
    { module: 'Module 5', title: 'Test Preparation', topics: ['Mock tests', 'RTO procedures', 'License exam tips', 'Final assessment'] }
  ];

  faqs = [
    { question: 'What is the minimum age for enrollment?', answer: 'Students must be at least 18 years old with a valid learner\'s license.' },
    { question: 'Do I need to bring my own bike?', answer: 'No, we provide well-maintained training bikes for all courses.' },
    { question: 'What if I miss a class?', answer: 'We offer flexible rescheduling options at no extra cost.' },
    { question: 'Is protective gear provided?', answer: 'Yes, we provide helmets and safety gear during training sessions.' }
  ];

  additionalServices = [
    { title: 'License Assistance', description: 'Complete support for RTO procedures and license tests', icon: 'license' },
    { title: 'Refresher Training', description: 'Special sessions for riders who want to brush up skills', icon: 'refresher' },
    { title: 'Corporate Training', description: 'Customized programs for organizations and groups', icon: 'corporate' },
    { title: 'Women-Only Batches', description: 'Dedicated batches for women riders', icon: 'women' }
  ];
}
