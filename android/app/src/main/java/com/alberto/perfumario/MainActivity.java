package com.alberto.perfumario;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FragranticaWardrobePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
