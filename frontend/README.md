## Dashboard Features

### CSV Upload & Batch Processing
- Upload CSV files to run predictions for multiple restaurants
- Results are displayed in a formatted table and available for download
- **Automatic Fallback**: If backend is unavailable, the model runs locally in the browser
- Status indicator shows whether you're using "Local Model" or "Cloud Model"

### Model Evaluation
- View model accuracy metrics in a dedicated evaluation panel
- Accessible via the (+) button in the header
- Shows precision, recall, F1-score, and confusion matrix

### Model Training (Admin/Business Owners Only)
- Retrain the model locally with custom data
- Upload training datasets and trigger retraining
- **Local-only feature**: Training runs in the browser, not available on Vercel deployment
- Useful for customizing the model to your specific restaurant data

### Deployment Notes
- **Vercel**: Uses local/client-side model inference. Backend services become optional enhancements.
- **Local Development**: Full access to backend model serving and training features.
- The app gracefully handles backend unavailability and switches to local mode automatically.
