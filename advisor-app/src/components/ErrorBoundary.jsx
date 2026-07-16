import { Component } from 'react';
import styles from './ErrorState.module.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap} dir="rtl">
          <div className={styles.mark}>!</div>
          <div className={styles.text}>משהו השתבש. נסה לרענן את הדף</div>
          <button className={styles.retry} onClick={() => window.location.reload()}>רענן</button>
        </div>
      );
    }
    return this.props.children;
  }
}
