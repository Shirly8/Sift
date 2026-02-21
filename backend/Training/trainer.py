import os
import sys
import pytorch_lightning as pl
from pytorch_lightning.callbacks import EarlyStopping, ModelCheckpoint, LearningRateMonitor
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

from dataloader import BASE_MODEL, build_datasets
from model import ABSAClassifier


def main(csv_path=None, mode='full', augment=False):


    ####################################
    # STEP 1: HYPERPARAMETERS
    ####################################

    batch_size   = 15
    max_epochs   = 3 if mode == 'full' else 1
    learning_rate = 2e-5

    # Use provided csv_path or default to absa_training.csv
    if csv_path is None:
        csv_path = os.path.join(os.path.dirname(__file__), "../Data/Training/absa_training.csv")

    save_dir = os.path.join(os.path.dirname(__file__), "../Models/absa-v1")


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
    # STEP 3: TRAIN
    ####################################

    total_steps = len(train_loader) * max_epochs

    model = ABSAClassifier(learning_rate=learning_rate, total_steps=total_steps)

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
    # STEP 4: SAVE MODEL
    ####################################

    os.makedirs(save_dir, exist_ok=True)
    model.model.save_pretrained(save_dir)
    tokenizer.save_pretrained(save_dir)

    print(f"Model saved to {save_dir}")



if __name__ == "__main__":
    csv_path = None
    mode = 'full'
    augment = False

    # Parse command-line arguments
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    if len(sys.argv) > 2:
        mode = sys.argv[2]
    if len(sys.argv) > 3:
        augment = sys.argv[3].lower() == 'true'

    main(csv_path=csv_path, mode=mode, augment=augment)
