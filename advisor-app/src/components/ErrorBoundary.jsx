import { Component } from 'react';
import styles from './ErrorState.module.css';
import { reportError } from '../errorReporter';

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
    // A render crash never reaches window.onerror — React swallows it here.
    reportError({ kind: 'react', message: error?.message ?? error, stack: error?.stack });
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
