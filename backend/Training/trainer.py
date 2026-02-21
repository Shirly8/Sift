import os
import pytorch_lightning as pl
from pytorch_lightning.callbacks import EarlyStopping, ModelCheckpoint, LearningRateMonitor
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

from dataloader import BASE_MODEL, build_datasets
from model import ABSAClassifier


def main():


    ####################################
    # STEP 1: HYPERPARAMETERS
    ####################################

    batch_size   = 15
    max_epochs   = 3
    learning_rate = 2e-5

    csv_path = os.path.join(os.path.dirname(__file__), "../Data/Training/absa_training.csv")
    save_dir = os.path.join(os.path.dirname(__file__), "../Models/absa-v1")



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
    main()
