import os
import sys
import pytorch_lightning as pl
from pytorch_lightning.callbacks import EarlyStopping, ModelCheckpoint, LearningRateMonitor
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

from dataloader import BASE_MODEL, build_datasets
from model import ABSAClassifier

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from ModelManager import ModelManager


def main(csv_path=None, mode='full', augment=False, fine_tune=False, source_model=None):


    ####################################
    # STEP 1: HYPERPARAMETERS
    ####################################

    batch_size   = 15
    max_epochs   = 3 if mode == 'full' else 1
    # Lower learning rate for fine-tuning to preserve prior knowledge
    learning_rate = 5e-6 if fine_tune else 2e-5

    # Use provided csv_path or default to absa_training.csv
    if csv_path is None:
        csv_path = os.path.join(os.path.dirname(__file__), "../Data/Training/absa_training.csv")

    # Initialize ModelManager for versioning
    model_manager = ModelManager()
    save_dir = None  # Will be set after training


    ####################################
    # STEP 1.5: AUGMENT DATA IF REQUESTED
    ####################################

    if augment:
        print("🔄 Augmenting training data...")
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
            from training_augmentor import SyntheticGenerator

            generator = SyntheticGenerator()
            gaps = generator.find_gaps(csv_path)

            if gaps:
                reviews = generator.fill_gaps(gaps)
                generator.write_csv(reviews)
                print(f"✓ Generated {len(reviews)} synthetic reviews")
            else:
                print("Data is well-balanced")
        except Exception as e:
            print("Augmentation failed. Proceeding with training without augmentation...")


    ####################################
    # STEP 2: BUILD DATASETS
    ####################################

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    train_ds, val_ds = build_datasets(
        csv_path=csv_path,
        tokenizer=tokenizer,
        use_mams=True
    )

    #num_workers: 4 on mac/linux, 0 on windows
    num_workers = 4 if os.name == 'posix' else 0

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=num_workers, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=batch_size, num_workers=num_workers, persistent_workers=True)



    ####################################
    # STEP 3: LOAD OR CREATE MODEL
    ####################################

    total_steps = len(train_loader) * max_epochs

    if fine_tune and source_model and os.path.exists(source_model):
        print(f"🔄 Fine-tuning from {source_model}...")
        # Load existing model weights
        model = ABSAClassifier(learning_rate=learning_rate, total_steps=total_steps)
        try:
            model.model = model.model.from_pretrained(source_model)
            print("✓ Loaded existing model weights")
        except Exception as e:
            print(f"⚠️  Could not load existing weights: {e}. Training from base model.")
            model = ABSAClassifier(learning_rate=learning_rate, total_steps=total_steps)
    else:
        # Train from scratch
        if fine_tune:
            print("⚠️  Fine-tune requested but no source model found. Training from base model.")
        model = ABSAClassifier(learning_rate=learning_rate, total_steps=total_steps)

    ####################################
    # STEP 4: TRAIN
    ####################################

    #callbacks
    checkpoint  = ModelCheckpoint(monitor="val_f1", mode="max", save_top_k=1)
    early_stop  = EarlyStopping(monitor="val_f1", patience=3, mode="max")
    lr_monitor  = LearningRateMonitor(logging_interval='step')

    trainer = pl.Trainer(
        max_epochs=max_epochs,
        callbacks=[checkpoint, early_stop, lr_monitor],
        accelerator='auto',
        devices=1,
        log_every_n_steps=10
    )

    trainer.fit(model, train_loader, val_loader)



    ####################################
    # STEP 5: SAVE MODEL
    ####################################

    # Get validation metrics for metadata
    val_metrics = trainer.validate(model, val_loader, verbose=False)
    accuracy = val_metrics[0].get('val_f1', None) if val_metrics else None

    # Save model to Models/ (overwrites previous)
    model_manager.save_model(model.model, tokenizer, accuracy=accuracy)



if __name__ == "__main__":
    csv_path = None
    mode = 'full'
    augment = False
    fine_tune = False
    source_model = None

    # Parse command-line arguments
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    if len(sys.argv) > 2:
        mode = sys.argv[2]
    if len(sys.argv) > 3:
        augment = sys.argv[3].lower() == 'true'
    if len(sys.argv) > 4:
        fine_tune = sys.argv[4].lower() == 'true'
    if len(sys.argv) > 5:
        source_model = sys.argv[5]

    main(csv_path=csv_path, mode=mode, augment=augment, fine_tune=fine_tune, source_model=source_model)
